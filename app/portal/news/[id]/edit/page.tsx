import { NewsEditor } from "../../news-editor";

export default async function EditNewsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <NewsEditor postId={id} />;
}
