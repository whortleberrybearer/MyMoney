import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  /** Optional label shown above the error message. Defaults to "Something went wrong". */
  heading?: string;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors from child components and shows a recoverable error
 * screen instead of a blank page.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-sm space-y-3 text-center">
            <p className="font-medium text-destructive">
              {this.props.heading ?? "Something went wrong"}
            </p>
            <p className="text-sm text-muted-foreground">
              {this.state.error.message}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
