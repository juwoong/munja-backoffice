import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Navigate, useLocation, useNavigate, type Location } from "react-router-dom";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { api, type LoginResponse } from "@/lib/api";

const loginSchema = z.object({
  email: z.string().email({ message: "Enter a valid email address" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" })
});

type LoginFormValues = z.infer<typeof loginSchema>;

const DUMMY_CREDENTIALS = {
  email: "test@test.com",
  password: "1234" as const
};

export function LoginPage() {
  const { token, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectPath = useMemo(() => {
    const fromState = location.state as { from?: Location } | undefined;
    return fromState?.from?.pathname ?? "/";
  }, [location.state]);

  const [formValues, setFormValues] = useState<LoginFormValues>({ email: "", password: "" });
  const [formErrors, setFormErrors] = useState<Record<keyof LoginFormValues, string>>({
    email: "",
    password: ""
  });
  const [apiError, setApiError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (values: LoginFormValues) => {
      const response = await api.post<LoginResponse>("/auth/login", values);
      return response.data;
    },
    onSuccess: (data) => {
      login(data);
      navigate(redirectPath, { replace: true });
    },
    onError: (error: unknown) => {
      if (error && typeof error === "object" && "response" in error) {
        const message = (error as any).response?.data?.error ?? "Invalid credentials";
        setApiError(message);
      } else {
        setApiError("Unexpected error. Please try again.");
      }
    }
  });

  if (token) {
    return <Navigate to="/" replace />;
  }

  const handleChange = (field: keyof LoginFormValues) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormValues((prev) => ({ ...prev, [field]: event.target.value }));
    setFormErrors((prev) => ({ ...prev, [field]: "" }));
    setApiError(null);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (
      formValues.email === DUMMY_CREDENTIALS.email &&
      formValues.password === DUMMY_CREDENTIALS.password
    ) {
      // Short-circuit login for the shared dummy credentials used in local testing
      setFormErrors({ email: "", password: "" });
      setApiError(null);
      login({
        token: "dummy-token",
        user: {
          id: "dummy-user",
          email: DUMMY_CREDENTIALS.email
        }
      });
      navigate(redirectPath, { replace: true });
      return;
    }

    const result = loginSchema.safeParse(formValues);

    if (!result.success) {
      const issues = result.error.flatten().fieldErrors;
      setFormErrors({
        email: issues.email?.[0] ?? "",
        password: issues.password?.[0] ?? ""
      });
      return;
    }

    mutation.mutate(result.data);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Backoffice Login</CardTitle>
          <CardDescription>Sign in with your administrator account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={formValues.email}
                onChange={handleChange("email")}
                required
              />
              {formErrors.email && <p className="text-sm text-destructive">{formErrors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={formValues.password}
                onChange={handleChange("password")}
                required
              />
              {formErrors.password && <p className="text-sm text-destructive">{formErrors.password}</p>}
            </div>

            {apiError && <p className="text-sm text-destructive">{apiError}</p>}

            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
