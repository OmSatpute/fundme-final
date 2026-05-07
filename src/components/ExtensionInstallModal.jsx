import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Chrome, Puzzle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { checkExtensionInstalled } from "@/lib/utils";

export function ExtensionInstallModal({ open, onOpenChange, onVerified, onIgnore }) {
  const [busy, setBusy] = useState(false);

  const handleVerify = async () => {
    setBusy(true);
    const isInstalled = await checkExtensionInstalled();
    
    if (isInstalled) {
      setBusy(false);
      toast.success("Extension detected! Redirecting...");
      onVerified?.();
      onOpenChange(false);
    } else {
      setBusy(false);
      // Store current path and refresh to inject content script
      sessionStorage.setItem("FUNDME_EXT_RELOAD", window.location.pathname);
      toast.info("Activating extension... Page will refresh briefly.", { duration: 2000 });
      setTimeout(() => window.location.reload(), 1500);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] border-none bg-white p-0 overflow-hidden rounded-2xl shadow-2xl">
        <div className="h-2 bg-[var(--accent)]" />
        
        <div className="p-8">
          <DialogHeader className="mb-6 text-center sm:text-left">
            <div className="w-12 h-12 bg-[var(--primary-light)] rounded-xl flex items-center justify-center text-[var(--accent)] mb-4 mx-auto sm:mx-0">
              <Puzzle size={24} />
            </div>
            <DialogTitle className="text-2xl font-display font-bold text-slate-900 tracking-tight">
              Use FundMe Extension
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-base mt-2">
              Install or verify the extension before opening the official portal so FundMe can fill the form from your draft.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mb-8">
            <h4 className="text-xs uppercase tracking-wider text-slate-400 font-bold">Installation Steps</h4>
            
            <div className="space-y-3">
              <Step number="1" text="Download and unzip the FundMe extension package." />
              <Step number="2" text="Open Chrome and navigate to chrome://extensions" />
              <Step number="3" text="Enable 'Developer mode' in the top right corner." />
              <Step number="4" text="Click 'Load unpacked' and select the unzipped folder." />
              <Step number="5" text="Return here, click Apply to Portal, review the filled form, and submit manually." />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                className="flex-1 h-12 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-semibold rounded-xl btn-press"
                onClick={() => window.open("#", "_blank")} // Placeholder link
              >
                <Download size={18} className="mr-2" /> Download Package
              </Button>
              <Button 
                variant="outline" 
                disabled={busy}
                className="flex-1 h-12 border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl"
                onClick={handleVerify}
              >
                {busy ? <Loader2 size={18} className="animate-spin mr-2" /> : <CheckCircle2 size={18} className="mr-2 text-[var(--accent)]" />}
                I've installed it
              </Button>
            </div>
            
            <button 
              onClick={() => {
                onIgnore?.();
                onOpenChange(false);
              }}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors font-medium text-center py-2 underline underline-offset-4"
            >
              Continue to portal without extension (AI auto-fill won't work)
            </button>
          </div>
        </div>

        <div className="bg-slate-50 p-4 px-8 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            <Chrome size={12} /> Chrome Browser Recommended
          </div>
          <CheckCircle2 size={16} className="text-slate-300" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Step({ number, text }) {
  return (
    <div className="flex items-start gap-3 group">
      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 group-hover:bg-[var(--primary-light)] group-hover:text-[var(--accent)] transition-colors shrink-0 mt-0.5">
        {number}
      </div>
      <p className="text-sm text-slate-600 leading-snug">{text}</p>
    </div>
  );
}
