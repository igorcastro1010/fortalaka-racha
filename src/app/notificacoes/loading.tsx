import { LoadingCards } from '@/components/ui/ScreenState';

export default function NotificationsLoading() {
  return <main className="mx-auto min-h-screen max-w-[640px] bg-background p-5 text-neutral-950">
    <h1 className="text-3xl font-black">Notificações</h1>
    <LoadingCards label="Carregando notificações..." />
  </main>;
}
