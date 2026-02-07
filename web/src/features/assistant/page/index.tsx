import Page from "@/src/components/layouts/page";
import useProjectIdFromURL from "@/src/hooks/useProjectIdFromURL";
import { api } from "@/src/utils/api";

export default function AssistantPage() {
  const projectId = useProjectIdFromURL();

  const ping = api.assistant.ping.useQuery(
    { projectId: projectId ?? "" },
    { enabled: Boolean(projectId) },
  );

  return (
    <Page
      headerProps={{
        title: "Assistant",
      }}
    >
      <div className="flex flex-col gap-2">
        <div className="text-sm text-muted-foreground">
          Assistant feature scaffold.
        </div>
        <div className="text-sm">
          API status:{" "}
          {ping.isLoading ? "loading" : ping.data?.ok ? "ok" : "unavailable"}
        </div>
      </div>
    </Page>
  );
}
