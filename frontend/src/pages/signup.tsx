import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { signup as signupRequest, type SignupResponse } from "@/lib/api";

const signupSchema = z
  .object({
    email: z.string().email({ message: "Enter a valid email address" }),
    password: z
      .string()
      .min(8, { message: "Password must be at least 8 characters" }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type SignupFormValues = z.infer<typeof signupSchema>;

export function SignupPage() {
  const { token } = useAuth();
  // const navigate = useNavigate();

  const [formValues, setFormValues] = useState<SignupFormValues>({
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [formErrors, setFormErrors] = useState<
    Record<keyof SignupFormValues, string>
  >({
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [apiError, setApiError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const mutation = useMutation<
    SignupResponse,
    unknown,
    Omit<SignupFormValues, "confirmPassword">
  >({
    mutationFn: signupRequest,
    onSuccess: () => {
      setSuccess(true);
    },
    onError: (error: unknown) => {
      if (error && typeof error === "object" && "response" in error) {
        const message = (error as any).response?.data?.error ?? "Signup failed";
        setApiError(message);
      } else {
        setApiError("Unexpected error. Please try again.");
      }
    },
  });

  if (token) {
    return <Navigate to="/" replace />;
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Registration Successful</CardTitle>
            <CardDescription>
              Your account has been created and is pending approval.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              An administrator will review your account. You will be able to log
              in once your account is approved.
            </p>
            <Button asChild className="w-full">
              <Link to="/login">Go to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleChange =
    (field: keyof SignupFormValues) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setFormValues((prev) => ({ ...prev, [field]: event.target.value }));
      setFormErrors((prev) => ({ ...prev, [field]: "" }));
      setApiError(null);
    };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const result = signupSchema.safeParse(formValues);

    if (!result.success) {
      const issues = result.error.flatten().fieldErrors;
      setFormErrors({
        email: issues.email?.[0] ?? "",
        password: issues.password?.[0] ?? "",
        confirmPassword: issues.confirmPassword?.[0] ?? "",
      });
      return;
    }

    const { confirmPassword, ...signupData } = result.data;
    mutation.mutate(signupData);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create Account</CardTitle>
          <CardDescription>
            Sign up for backoffice access. Your account will need approval.
          </CardDescription>
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
              {formErrors.email && (
                <p className="text-sm text-destructive">{formErrors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={formValues.password}
                onChange={handleChange("password")}
                required
              />
              {formErrors.password && (
                <p className="text-sm text-destructive">
                  {formErrors.password}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={formValues.confirmPassword}
                onChange={handleChange("confirmPassword")}
                required
              />
              {formErrors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {formErrors.confirmPassword}
                </p>
              )}
            </div>

            {apiError && <p className="text-sm text-destructive">{apiError}</p>}

            <Button
              type="submit"
              className="w-full"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Creating account..." : "Sign up"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
