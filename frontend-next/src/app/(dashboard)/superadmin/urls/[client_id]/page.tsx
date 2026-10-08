import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "antd";
import AuthGuard from "@/components/auth/AuthGuard";
import ShortUrls from "@/components/superadmin/ShortUrls";

export const metadata: Metadata = { title: "Client Short URLs" };

type Props = PageProps<"/superadmin/urls/[client_id]">;

// `params` is only known at request time, so it is awaited inside <Suspense>
async function ClientShortUrls({ params }: { params: Props["params"] }) {
  const { client_id } = await params;
  return <ShortUrls clientId={client_id} />;
}

export default function SuperadminClientUrlsPage(props: Props) {
  return (
    <AuthGuard allowedUserType={["superadmin"]}>
      <Suspense fallback={<Skeleton active />}>
        <ClientShortUrls params={props.params} />
      </Suspense>
    </AuthGuard>
  );
}
