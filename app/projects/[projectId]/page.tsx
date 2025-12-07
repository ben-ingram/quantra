import { redirect } from "next/navigation";

// Redirect from old project page to new hub page
export default function ProjectPage({
  params,
}: {
  params: { projectId: string };
}) {
  redirect(`/project/${params.projectId}/hub`);
}
