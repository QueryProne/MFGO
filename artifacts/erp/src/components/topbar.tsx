import { Bell, Settings } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "./theme-provider";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { UniversalSearch } from "@/components/search/universal-search";

export function Topbar() {
  const { theme, setTheme } = useTheme();

  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-50">
      <div className="flex items-center gap-4 flex-1">
        <SidebarTrigger className="hover-elevate" />
        <UniversalSearch />
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground relative group">
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full border-2 border-background group-hover:border-secondary"></span>
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 w-9 p-0 rounded-full hover-elevate ring-2 ring-transparent focus-visible:ring-primary/50 transition-all">
              <Avatar className="h-8 w-8">
                <AvatarImage src="https://i.pravatar.cc/150?u=admin" />
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">AD</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mt-1 rounded-xl shadow-xl border-border/50">
            <DropdownMenuLabel className="font-normal p-3">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-semibold leading-none text-foreground">Admin User</p>
                <p className="text-xs leading-none text-muted-foreground font-medium">admin@manufactureos.com</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border/50" />
            <DropdownMenuItem className="py-2 cursor-pointer focus:bg-secondary rounded-md mx-1">
              <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Preferences</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="py-2 cursor-pointer focus:bg-secondary rounded-md mx-1"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4 text-muted-foreground"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4 text-muted-foreground"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
                  <span>Dark Mode</span>
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border/50" />
            <DropdownMenuItem className="py-2 cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive rounded-md mx-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
