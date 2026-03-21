import { Component, type ErrorInfo, type ReactNode } from "react";
import { logWidget } from "./widget-log.js";

type Props = { children: ReactNode };

type State = { hasError: boolean };

export class WidgetErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logWidget(
      "error",
      `${error.message} ${info.componentStack?.slice(0, 200) ?? ""}`.trim(),
    );
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <p className="text-sm text-red-600 dark:text-red-400">
          Something went wrong — check the debug log below.
        </p>
      );
    }
    return this.props.children;
  }
}
