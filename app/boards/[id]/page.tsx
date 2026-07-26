import { requireChatGPTUser } from "../../chatgpt-auth";
import { BoardCanvas } from "../../board/[code]/BoardCanvas";

export const dynamic = "force-dynamic";

export default async function ManageBoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireChatGPTUser(`/boards/${id}`);
  return <BoardCanvas boardId={id} manage />;
}
