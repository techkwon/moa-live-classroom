import { BoardCanvas } from "./BoardCanvas";

export const dynamic = "force-dynamic";

export default async function PublicBoardPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <BoardCanvas code={code.replace(/\D/g, "")} />;
}
