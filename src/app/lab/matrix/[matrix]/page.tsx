import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MATRICES, matrixOf } from "../matrices";
import { MatrixView } from "../matrix-view";
import { requireStudioLogin, studioMetadataOf } from "@/lib/http/studio-access";

export function generateMetadata(): Promise<Metadata> {
  return studioMetadataOf("Matrix");
}

/** Every registered matrix, prerendered; any other path is not found. */
export function generateStaticParams(): { matrix: string }[] {
  return MATRICES.map(({ key }) => ({ matrix: key }));
}

// A matrix is opened by its URL from the lab, so it may wait for its params rather than
// show a placeholder first.
export const instant = false;

export default async function MatrixPage({ params }: PageProps<"/lab/matrix/[matrix]">) {
  await requireStudioLogin();
  const { matrix: key } = await params;
  const matrix = matrixOf(key);
  if (!matrix) notFound();
  return (
    // The header keeps the page's measure; the grid takes the whole width and scrolls
    // sideways inside itself, because a row of phone-width cells is wider than any page.
    <main className="flex flex-col gap-8 px-6 py-16">
      <header className="mx-auto flex w-full max-w-page flex-col gap-2">
        <h1 className="type-voice text-display">{matrix.title}</h1>
        <p className="max-w-measure text-body text-ink-soft">{matrix.note}</p>
      </header>
      <MatrixView matrixKey={matrix.key} />
    </main>
  );
}
