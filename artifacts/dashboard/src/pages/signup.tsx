import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { makeZodResolver } from "@/lib/zod-form-resolver";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LayoutDashboard, Loader2, Key, Copy, Check } from "lucide-react";
import { toast } from "sonner";

const signupSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  shopId: z.string().min(3, "Shop domain is required (e.g., mystore.myshopify.com)"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function Signup() {
  const { login, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [pendingAuth, setPendingAuth] = useState<{ token: string; shopId: string; email: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isAuthenticated && !newApiKey) {
      setLocation("/settings");
    }
  }, [isAuthenticated, newApiKey, setLocation]);

  const form = useForm<SignupFormValues>({
    resolver: makeZodResolver(signupSchema),
    defaultValues: {
      email: "",
      shopId: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: SignupFormValues) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, shopId: data.shopId, password: data.password }),
      });

      const body = await res.json() as {
        token?: string;
        apiKey?: string;
        shopId?: string;
        email?: string;
        error?: string;
      };

      if (res.ok && body.token && body.apiKey) {
        setPendingAuth({ token: body.token, shopId: body.shopId!, email: body.email! });
        setNewApiKey(body.apiKey);
      } else {
        toast.error("Signup Failed", {
          description: body.error ?? "Something went wrong. Please try again.",
        });
      }
    } catch {
      toast.error("Connection Error", {
        description: "Failed to connect to the server. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyApiKey = () => {
    if (!newApiKey) return;
    navigator.clipboard.writeText(newApiKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (newApiKey) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8 text-center">
            <div className="bg-primary/10 p-4 rounded-2xl text-primary mb-4">
              <Key size={40} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Save Your API Key</h1>
            <p className="text-muted-foreground mt-2">Copy it now — it won't be shown again</p>
          </div>

          <Alert className="border-amber-400 bg-amber-50 dark:bg-amber-950/30 mb-6">
            <Key className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800 dark:text-amber-200">Store this API key securely</AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-300 text-sm mt-1">
              This is the only time your API key will be displayed. You can rotate it later from the API Keys page, but you cannot retrieve this key again.
            </AlertDescription>
          </Alert>

          <Card className="border-border shadow-lg mb-4">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm bg-muted rounded-md px-3 py-2.5 font-mono break-all select-all">
                  {newApiKey}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyApiKey}
                  className="shrink-0"
                  data-testid="button-copy-api-key"
                >
                  {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Button
            className="w-full"
            onClick={() => {
              if (pendingAuth) {
                login(pendingAuth);
              }
              setLocation("/settings");
            }}
            data-testid="button-continue-to-dashboard"
          >
            Continue to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="bg-primary/10 p-4 rounded-2xl text-primary mb-4">
            <LayoutDashboard size={40} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Create Account</h1>
          <p className="text-muted-foreground mt-2">Set up your AI sales assistant</p>
        </div>

        <Card className="border-border shadow-lg">
          <CardHeader>
            <CardTitle>Sign Up</CardTitle>
            <CardDescription>Create your merchant account to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="you@yourstore.com"
                          autoComplete="email"
                          data-testid="input-email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="shopId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shop Domain</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="mystore.myshopify.com"
                          autoComplete="off"
                          data-testid="input-shop-id"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Your Shopify store domain</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Minimum 8 characters"
                          autoComplete="new-password"
                          data-testid="input-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          autoComplete="new-password"
                          data-testid="input-confirm-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                  data-testid="button-submit-signup"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </form>
            </Form>

            <div className="mt-5 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/" className="text-primary underline underline-offset-4 hover:opacity-80">
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
