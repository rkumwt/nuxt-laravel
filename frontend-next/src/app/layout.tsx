import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import Providers from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
	title: {
		template: "%s | URL Shortner",
		default: "URL Shortner",
	},
};

export default function RootLayout({ children }: LayoutProps<"/">) {
	return (
		<html lang="en">
			<body>
				{/* Collects antd's CSS-in-JS styles during server rendering */}
				<AntdRegistry>
					<Providers>{children}</Providers>
				</AntdRegistry>
			</body>
		</html>
	);
}
