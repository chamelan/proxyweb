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
		const io = new Server(res.socket.server)
		res.socket.server.io = io

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

			socket.on("info", async (e) => {
				gotInfo = true
				userAgent = e.userAgent
				windowX = e.windowX
				windowY = e.windowY
			})

			const browser = await puppeteer.launch()
			const page = await browser.newPage()
			await resizeWindow(browser, page, windowX, windowY)
			await page.setUserAgent(userAgent)
			const client = await page.target().createCDPSession()

			const getData = async () => {
				return page.evaluate(async () => {
					return await new Promise((resolve) => {
						resolve("")
					})
				})
			}

			//just for developmental purposes
			await installMouseHelper(page)

			await page.goto("https://www.google.com/")

			console.log(await getData())

			let keys = [
				"Enter",
				"ArrowDown",
				"ArrowUp",
				"Backspace",
				"Shift",
				"Alt",
				"Escape",
				"Control",
				"ArrowLeft",
				"ArrowRight",
			]

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

			socket.on("keystroke", async (e) => {
				if (keys.includes(e)) {
					await page.keyboard.press(e)
				} else {
					await page.keyboard.type(e)
				}
			})

			socket.on("click", async (e) => {
				await page.mouse.click(e.x, e.y)
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

			socket.on("disconnect", async () => {
				await browser.close()
			})
		})
	}
	res.end()
}

export default SocketHandler
