import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Theme } from "@/presentation/hooks/useTheme";

type SystemSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const THEME_OPTIONS = [
  { id: "light", icon: Sun, label: "Light" },
  { id: "dark", icon: Moon, label: "Dark" },
  { id: "system", icon: Monitor, label: "System" },
] as const;

export function SystemSettingsDialog({ open, onOpenChange, theme, setTheme }: SystemSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>System-level preferences for zhNote.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="appearance">
          <TabsList className="mb-4 h-auto w-full justify-start rounded-none border-b bg-transparent p-0">
            <TabsTrigger
              value="appearance"
              className="rounded-none border-b-2 border-transparent bg-transparent px-4 py-2 shadow-none data-[state=active]:border-primary"
            >
              Appearance
            </TabsTrigger>
            <TabsTrigger
              value="about"
              className="rounded-none border-b-2 border-transparent bg-transparent px-4 py-2 shadow-none data-[state=active]:border-primary"
            >
              About
            </TabsTrigger>
          </TabsList>

          <TabsContent value="appearance" className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {THEME_OPTIONS.map((option) => (
                <Button
                  key={option.id}
                  variant={theme === option.id ? "default" : "outline"}
                  className="h-20 flex-col gap-2"
                  onClick={() => setTheme(option.id)}
                >
                  <option.icon className="size-5" />
                  <span className="text-[11px] font-bold uppercase">{option.label}</span>
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Shortcut: Cmd/Ctrl + ,</p>
          </TabsContent>

          <TabsContent value="about" className="space-y-2 py-8 text-center">
            <h3 className="text-lg font-bold">zhNote</h3>
            <p className="text-xs italic text-muted-foreground">v0.1.0</p>
            <p className="mx-auto max-w-xs text-sm">Native high-performance minimalist Markdown editor.</p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
