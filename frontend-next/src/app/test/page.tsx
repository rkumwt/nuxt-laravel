"use client";

import { Button } from "antd";

export default function TestPage() {
	const confirm = () => {
		alert("yes");
	};

	return (
		<Button type="primary" onClick={confirm}>
			Hello
		</Button>
	);
}
