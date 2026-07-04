import { Component, type ReactNode } from 'react';
import { ErrorState } from './ui/ErrorState';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return (
        <ErrorState
          title="This page ran into a problem"
          description="An unexpected error stopped it from loading. Try again, or reload the page if it keeps happening."
          onRetry={this.reset}
        />
      );
    }
    return this.props.children;
  }
}
