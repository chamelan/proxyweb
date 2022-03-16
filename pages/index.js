import { io } from "socket.io-client"
import { useEffect } from "react"
import { useState } from "react"

const home = () => {
	let socket
	const [page, setPage] = useState()

	useEffect(async () => {
		await fetch("/api/proxy")

		socket = io()

		socket.on("connect", () => {
			window.onresize = (e) => {
				socket.emit(
					"windowsize",
					JSON.stringify({
						x: window.innerWidth,
						y: window.innerHeight,
					})
				)
			}

			document.getElementsByTagName("body")[0].onkeyup = (e) => {
				socket.emit("keystroke", e.key)
			}

			window.onclick = (e) => {
				socket.emit(
					"click",
					JSON.stringify({
						x: e.offsetX,
						y: e.offsetY,
					})
				)
			}

			window.onmouseenter = (e) => {
				console.log(e)
			}

			window.onmousemove = (e) => {
				socket.emit(
					"windowsize",
					JSON.stringify({
						x: window.innerWidth,
						y: window.innerHeight,
					})
				)

				socket.emit(
					"move",
					JSON.stringify({
						x: e.offsetX,
						y: e.offsetY,
					})
				)
			}
		})

		document.getElementById("forward").onclick = () => {
			socket.emit("forward", "1")
		}
		document.getElementById("back").onclick = () => {
			socket.emit("back", "1")
		}

		socket.on("pageimg", (e) => {
			const img = new Image()
			img.src = `data:image/jpg;base64,${Buffer.from(e)}`
			setPage(img.src)
		})
	}, [])

	if (page !== undefined) {
		return (
			<>
				<img src={page} />
				<a id="back">back</a>
				<span id="forward">forward</span>
			</>
		)
	} else {
		return (
			<>
				<br></br>
				loading...
				<br></br>
				Use arrow keys to scroll down/up
				<a id="back">back</a>
				<span id="forward">forward</span>
			</>
		)
	}
}

export default home
