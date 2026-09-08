import { JarvisChat } from "@/components/app/jarvis-chat";
export default async function JarvisConversationPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <JarvisChat key={id} id={id} />; }
