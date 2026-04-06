import { useState } from "react";
import { useMerchantInfo, useRotateApiKey } from "@/hooks/use-api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Key, RefreshCw, Copy, Check, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

function maskKey(prefix: string | null): string {
  if (!prefix) return "ow_live_••••••••••••••••";
  return `${prefix}••••••••••••••••••••••••••••••`;
}

export default function ApiKeys() {
  const { data: merchant, isLoading } = useMerchantInfo();
  const rotateKey = useRotateApiKey();
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleRotate = async () => {
    try {
      const result = await rotateKey.mutateAsync() as { apiKey: string; apiKeyCreatedAt: string };
      setNewKey(result.apiKey);
      setShowRotateConfirm(false);
      toast.success("API key rotated", {
        description: "Your old API key has been invalidated. Copy the new one below.",
      });
    } catch (err) {
      toast.error("Rotation failed", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">API Keys</h1>
        <p className="text-muted-foreground mt-1">
          Your API key is used to authenticate the Omniweb widget on your store.
        </p>
      </div>

      {newKey && (
        <Alert className="border-amber-400 bg-amber-50 dark:bg-amber-950/30">
          <Key className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-200">New key generated — copy it now</AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300 text-sm mt-2">
            This is the only time your new API key will be shown.
            <div className="flex items-center gap-2 mt-2">
              <code className="flex-1 text-xs bg-white/60 dark:bg-black/30 rounded px-2 py-1.5 font-mono break-all select-all">
                {newKey}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyKey(newKey)}
                className="shrink-0 h-8 w-8"
              >
                {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key size={20} />
            Current API Key
          </CardTitle>
          <CardDescription>
            Use this key in your Shopify theme's widget script tag as{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">data-api-key</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <code className="flex-1 text-sm bg-muted rounded-md px-3 py-2.5 font-mono text-muted-foreground">
              {maskKey(merchant?.apiKeyPrefix ?? null)}
            </code>
            <Badge variant="secondary" className="shrink-0">
              Live
            </Badge>
          </div>

          {merchant?.apiKeyCreatedAt && (
            <p className="text-sm text-muted-foreground">
              Last updated:{" "}
              {new Date(merchant.apiKeyCreatedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}

          {!merchant?.apiKeyPrefix && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              No API key found. Click "Rotate Key" to generate your first key.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle size={20} />
            Rotate API Key
          </CardTitle>
          <CardDescription>
            Generating a new key immediately invalidates the old one. Update your Shopify theme right away.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showRotateConfirm ? (
            <Button
              variant="destructive"
              onClick={() => setShowRotateConfirm(true)}
              data-testid="button-rotate-key"
            >
              <RefreshCw size={16} className="mr-2" />
              Rotate Key
            </Button>
          ) : (
            <div className="space-y-3">
              <Alert className="border-destructive/50">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <AlertTitle>Are you sure?</AlertTitle>
                <AlertDescription>
                  Your current API key will stop working immediately. You'll need to update your Shopify theme with the new key.
                </AlertDescription>
              </Alert>
              <div className="flex gap-3">
                <Button
                  variant="destructive"
                  onClick={handleRotate}
                  disabled={rotateKey.isPending}
                  data-testid="button-confirm-rotate"
                >
                  {rotateKey.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Rotating...
                    </>
                  ) : (
                    "Yes, rotate my key"
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowRotateConfirm(false)}
                  disabled={rotateKey.isPending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
