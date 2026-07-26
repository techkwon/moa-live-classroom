import { requireChatGPTUser } from "../chatgpt-auth";
import { BoardStudio } from "./BoardStudio";

export const dynamic = "force-dynamic";

export default async function BoardsPage() {
  const user = await requireChatGPTUser("/boards");
  return <BoardStudio userName={user.displayName} />;
}
