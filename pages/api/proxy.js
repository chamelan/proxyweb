import { Server } from "socket.io"
const { installMouseHelper } = require("./mousehelper")
const puppeteer = require("puppeteer-extra")
const StealthPlugin = require("puppeteer-extra-plugin-stealth")
puppeteer.use(StealthPlugin())

function makeid(length) {
	var result = ""
	var characters =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	var charactersLength = characters.length
	for (var i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength))
	}
	return result
}

async function resizeWindow(browser, page, width, height) {
	await page.setViewport({ height, width })

	// Window frame - probably OS and WM dependent.
	height += 85

	// Any tab.
	const targets = await browser._connection.send("Target.getTargets")

	// modified code
	const target = targets.targetInfos.filter(
		(t) => t.attached === true && t.type === "page"
	)[0]

	// Tab window.
	const { windowId } = await browser._connection.send(
		"Browser.getWindowForTarget",
		{ targetId: target.targetId }
	)
	const { bounds } = await browser._connection.send("Browser.getWindowBounds", {
		windowId,
	})

	const resize = async () => {
		await browser._connection.send("Browser.setWindowBounds", {
			bounds: { width: width, height: height },
			windowId,
		})
	}

	if (bounds.windowState === "normal") {
		await resize()
	} else {
		await browser._connection.send("Browser.setWindowBounds", {
			bounds: { windowState: "minimized" },
			windowId,
		})
		await resize()
	}
}

const SocketHandler = async (req, res) => {
	if (!res.socket.server.io) {
		const io = new Server(res.socket.server, {
			path: "/api/proxy",
			transports: ["websocket"],
		})

		res.socket.server.io = io
		let host = res.req.headers.host

		io.on("connection", async (socket) => {
			let gotInfo = false
			let userAgent
			let windowX
			let windowY

			socket.emit("getinfo")

			let timeOut = setTimeout(() => {
				if (!gotInfo) {
					socket.disconnect(true)
					clearInterval(timeOut)
				}
			}, 10000)

			socket.on("log", async (e) => {
				console.log(e)
			})

			socket.on("info", async (e) => {
				if (e.audio) {
					let id = e.id
					gotInfo = true

					socket.on("audio", async (e) => {
						socket.to(id).emit("audio", e)
					})

					return true
				}

				gotInfo = true
				userAgent = e.userAgent
				windowX = e.windowX
				windowY = e.windowY

				const browser = await puppeteer.launch({
					headless: true,
					ignoreHTTPSErrors: true,
					devtools: false,
					args: [
						"--autoplay-policy=no-user-gesture-required",
						"--no-sandbox",
						"--disable-accelerated-video-decode",
						"--disable-accelerated-video-encode",
						"--disable-setuid-sandbox",
						"--netifs-to-ignore=eth0",
					],
				})
				const page = await browser.newPage()
				const context = browser.defaultBrowserContext()
				await resizeWindow(browser, page, windowX, windowY)
				await page.setUserAgent(userAgent)
				const client = await page.target().createCDPSession()

				await page.setBypassCSP(true)

				await page.on("load", async () => {
					let url = await page.url()
					socket.emit("url", url)
				})

				//just for developmental purposes
				//await installMouseHelper(page)

				/*/
				await page.on("load", async () => {
					await page.addScriptTag({
						url: "https://cdn.socket.io/4.4.1/socket.io.min.js",
					})

					await page.evaluate(
						(socketID, host) => {
							let fullHost = "http://" + host
							let socket = io(fullHost, {
								path: "/api/proxy",
								transports: ["websocket"],
							})

							let isPlaying = (content) => {
								if (!content.paused) {
									return content.src
								} else {
									return false
								}
							}

							let sendAudio = async (audio, time, playing) => {
								socket.emit("audio", {
									audio: audio,
									time: time,
									playing: playing,
								})
							}

							for (const video of document.querySelectorAll("video")) {
								if (isPlaying(video)) {
									sendAudio(video.src, video.currentTime, true)
								}
							}

							document.querySelectorAll("video").forEach((video) => {
								video.addEventListener("play", (content) => {
									sendAudio(
										content.target.src,
										content.target.currentTime,
										true
									)
								})
								video.addEventListener("pause", (content) => {
									sendAudio(
										content.target.src,
										content.target.currentTime,
										false
									)
								})
							})

							socket.on("getinfo", () => {
								socket.emit("info", {
									audio: true,
									id: socketID,
								})
							})
						},
						socket.id,
						host
					)

					await page.waitForNavigation({
						waitUntil: "networkidle0",
						timeOut: 5 * 1000,
					})

					await page.addScriptTag({
						url: "https://cdn.socket.io/4.4.1/socket.io.min.js",
					})

					await page.evaluate(
						(socketID, host) => {
							let fullHost = "http://" + host
							let socket = io(fullHost, {
								path: "/api/proxy",
								transports: ["websocket"],
							})

							let isPlaying = (content) => {
								if (!content.paused) {
									return content.src
								} else {
									return false
								}
							}

							let sendAudio = async (audio, time, playing) => {
								socket.emit("audio", {
									audio: audio,
									time: time,
									playing: playing,
								})
							}

							document.querySelectorAll("audio").forEach((audio) => {
								audio.addEventListener("play", (content) => {
									sendAudio(
										content.target.src,
										content.target.currentTime,
										true
									)
								})
								audio.addEventListener("pause", (content) => {
									sendAudio(
										content.target.src,
										content.target.currentTime,
										false
									)
								})
							})

							for (const audio of document.querySelectorAll("audio")) {
								if (isPlaying(audio)) {
									sendAudio(audio.src, audio.currentTime, true)
								}
							}

							socket.on("getinfo", () => {
								socket.emit("info", {
									audio: true,
									id: socketID,
								})
							})
						},
						socket.id,
						host
					)
				})/*/

				await page.goto("https://www.google.com/")

				await client.send("Page.startScreencast", {
					format: "jpeg",
					maxWidth: 1920,
					maxHeight: 1080,
					quality: 100,
					everyNthFrame: 2,
				})

				client.on("Page.screencastFrame", async (frameObject) => {
					socket.emit("pageimg", frameObject.data)
					await client.send("Page.screencastFrameAck", {
						sessionId: frameObject.sessionId,
					})
				})

				socket.on("windowsize", async (e) => {
					windowX = e.x
					windowY = e.y
					await resizeWindow(browser, page, windowX, windowY)
				})

				socket.on("keydown", async (e) => {
					await page.keyboard.down(e)
				})

				socket.on("keyup", async (e) => {
					await context.overridePermissions(await page.url(), [
						"clipboard-read",
					])

					const copiedText = await page.evaluate(
						`(async () => await navigator.clipboard.readText())()`
					)
					socket.emit("clipboard", copiedText)

					await page.keyboard.up(e)
				})

				socket.on("mousedown", async (e) => {
					if (e) {
						await page.mouse.down()
					} else {
						await page.mouse.up()
					}
				})

				socket.on("move", async (e) => {
					await page.mouse.move(e.x, e.y)
				})

				socket.on("back", async (e) => {
					await page.goBack()
				})

				socket.on("wheel", async (e) => {
					await page.evaluate(async (e) => {
						window.scrollBy(0, e.y)
					}, e)
				})

				socket.on("forward", async (e) => {
					await page.goForward()
				})

				function CheckIsValidDomain(domain) {
					var re = new RegExp(
						/(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/
					)
					return domain.match(re)
				}

				socket.on("url", async (e) => {
					try {
						if (CheckIsValidDomain(e)) {
							page.goto(e)
						}
					} catch {}
				})

				socket.on("refresh", async (e) => {
					await page.reload()
				})

				socket.on("disconnect", async () => {
					await browser.close()
				})
			})
		})
	}
	res.end()
}

export default SocketHandler
