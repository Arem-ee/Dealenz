import { notFound } from "next/navigation"
import { InviteeSignView } from "@/components/sign/invitee-sign-view"
import { getInviteeView } from "./actions"

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function SignPage({ params }: PageProps) {
  const { token } = await params
  const { found, view } = await getInviteeView(token)
  if (!found || !view) {
    notFound()
  }
  return <InviteeSignView token={token} initial={view} />
}
