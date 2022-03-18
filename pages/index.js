import { io } from "socket.io-client"
import { useEffect } from "react"
import { useState } from "react"
import styles from "../styles/main.module.css"

const Home = ({ headers }) => {
	let socket
	const [page, setPage] = useState("")

	useEffect(async () => {
		await fetch("/api/proxy")

		document.onkeydown = () => {
			return false
		}

		socket = io()

		socket.on("connect", () => {
			window.onresize = (e) => {
				socket.emit("windowsize", {
					x: window.innerWidth,
					y: Math.round(window.innerHeight * 0.9),
				})
			}

			document.getElementsByTagName("body")[0].onkeyup = (e) => {
				socket.emit("keystroke", e.key)
			}

			window.onclick = (e) => {
				socket.emit("click", {
					x: e.offsetX,
					y: e.offsetY,
				})
			}

			window.onwheel = (e) => {
				socket.emit("wheel", {
					y: e.deltaY,
				})
			}

			window.onmousemove = (e) => {
				if (e.pageY > window.innerHeight * 0.1) {
					socket.emit("move", {
						x: e.offsetX,
						y: e.offsetY,
					})
				}
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

		socket.on("getinfo", () => {
			socket.emit("info", {
				userAgent: headers["user-agent"],
				windowX: window.innerWidth,
				windowY: Math.round(window.innerHeight * 0.9),
			})
		})
	}, [])

	if (page !== "") {
		return (
			<>
				<div className={styles["overfill"]}></div>
				<div className={styles["pagecontainer"]}>
					<img src={page} className={styles["page"]} />
				</div>
				<a id="back">back</a>
				<span id="forward">forward</span>
			</>
		)
	} else {
		return (
			<>
				<br></br>
				loading...
				<a id="back">back</a>
				<span id="forward">forward</span>
			</>
		)
	}
}

export const getServerSideProps = (context) => {
	let headers = context.req.headers
	return {
		props: { headers },
	}
}

export default Home
