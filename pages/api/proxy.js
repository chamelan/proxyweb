import { Server } from "socket.io"
import playwright from "playwright"
const { installMouseHelper } = require("./mousehelper")

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
	const browser = await playwright.chromium.launch()
	const page = await browser.newPage()
	await page.goto("https://www.google.com/")

	let img = (await page.screenshot()).toString("base64")
	console.log(`data:image/jpg;base64,${Buffer.from(img)}`)

	if (!res.socket.server.io) {
		const io = new Server(res.socket.server)
		res.socket.server.io = io

		io.on("connection", async (socket) => {
			const browser = await playwright.chromium.launch()
			const page = await browser.newPage()

			await installMouseHelper(page)

			await page.goto("https://www.google.com/")

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

			const sendImage = async () => {
				socket.emit("pageimg", (await page.screenshot()).toString("base64"))
			}

			let interval = setInterval(() => {
				sendImage()
			}, 1000)

			socket.on("windowsize", async (e) => {
				let parsed = JSON.parse(e)
				let x = parsed.x
				let y = parsed.y
				await resizeWindow(browser, page, x, y)
			})

			socket.on("keystroke", async (e) => {
				if (keys.includes(e)) {
					await page.keyboard.press(e)
				} else {
					await page.keyboard.type(e)
				}
			})

			socket.on("click", async (e) => {
				let parsed = JSON.parse(e)
				await page.mouse.click(parsed.x, parsed.y)
			})

			socket.on("move", async (e) => {
				let parsed = JSON.parse(e)
				await page.mouse.move(parsed.x, parsed.y)
			})

			socket.on("back", async (e) => {
				console.log("yoo")
				await page.goBack()
			})

			socket.on("forward", async (e) => {
				await page.goForward()
			})

			socket.on("disconnect", async () => {
				clearInterval(interval)
				await browser.close()
			})
		})
	}
	res.end()
}

export default SocketHandler
