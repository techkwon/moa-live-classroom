import { requireChatGPTUser, chatGPTSignOutPath } from "../chatgpt-auth";
import { SessionBuilder } from "./SessionBuilder";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireChatGPTUser("/dashboard");
  return (
    <SessionBuilder
      user={{ displayName: user.displayName, email: user.email }}
      signOutPath={chatGPTSignOutPath("/")}
    />
  );
}
