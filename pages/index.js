import { io } from "socket.io-client"
import { useEffect } from "react"
import { useState } from "react"
import styles from "../styles/main.module.css"
import Rotate from "../public/rotate.svg"
import Back from "../public/back.svg"
import Forward from "../public/forward.svg"

const Home = ({ headers }) => {
	const [socket, setSocket] = useState("")
	const [page, setPage] = useState("")
	const [url, setUrl] = useState("https://www.google.com/")

	useEffect(async () => {
		await fetch("/api/proxy")

		document.onkeydown = (e) => {
			if (styles["url"] !== e.target.className) {
			}
		}

		let socket = io({
			transports: ["websocket"],
			path: "/api/proxy",
		})
		setSocket(socket)

		socket.on("connect", () => {
			let mousepos = false
			window.onkeydown = (e) => {
				if (mousepos) {
					socket.emit("keydown", e.key)
				}
			}

			window.onkeyup = (e) => {
				if (mousepos) {
					socket.emit("keyup", e.key)
				}
			}

			window.onresize = (e) => {
				socket.emit("windowsize", {
					x: window.innerWidth,
					y: Math.round(window.innerHeight * 0.9),
				})
			}

			window.onwheel = (e) => {
				socket.emit("wheel", {
					y: e.deltaY,
				})
			}

			window.onmousedown = () => {
				socket.emit("mousedown", true)
			}

			window.onmousemove = (e) => {
				if (e.pageY > window.innerHeight * 0.1) {
					mousepos = true
					socket.emit("move", {
						x: e.offsetX,
						y: e.offsetY,
					})
				} else {
					mousepos = false
				}
			}

			window.onmouseup = (e) => {
				socket.emit("mousedown", false)
			}
		})

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

		let clipboard = ""
		socket.on("clipboard", (e) => {
			try {
				if (e !== clipboard) {
					navigator.clipboard.writeText(e)
					clipboard = e
				}
			} catch {}
		})

		socket.on("url", (e) => {
			try {
				setUrl(e)
			} catch {}
		})
	}, [])

	if (page !== "") {
		return (
			<>
				<div className={styles["overfill"]}></div>
				<div className={styles["pagecontainer"]}>
					<div
						className={styles["cover"]}
						onContextMenu={(e) => {
							e.preventDefault()
						}}
					/>
					<img id="page" src={page} className={styles["page"]} />
				</div>
				<div className={styles["container"]}>
					<div className={styles["tabs"]}>aa</div>
					<div className={styles["options"]}>
						<Back
							className={styles["back"]}
							onClick={() => {
								socket.emit("back", "1")
							}}
						/>
						<Forward
							className={styles["forward"]}
							onClick={() => {
								socket.emit("forward", "1")
							}}
						/>
						<Rotate
							className={styles["rotate"]}
							onClick={() => {
								socket.emit("refresh", "1")
							}}
						/>
						<form
							onSubmit={(e) => {
								e.preventDefault()
								socket.emit("url", e.target.url.value)
							}}>
							<input
								type="text"
								name="url"
								value={url}
								className={styles["url"]}
								onChange={(e) => {
									setUrl(e.target.value)
								}}
							/>
						</form>
					</div>
				</div>
			</>
		)
	} else {
		return <>loading...</>
	}
}

export const getServerSideProps = (context) => {
	let headers = context.req.headers
	return {
		props: { headers },
	}
}

export default Home
