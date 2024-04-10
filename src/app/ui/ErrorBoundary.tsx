import React /*{Component, ErrorInfo}*/ from 'react';

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

function ErrorFallback() {
  return (
    <div>
      <h2>Something went wrong.</h2>
      <p>Please try again later.</p>
    </div>
  );
}

function ErrorBoundary({children}: ErrorBoundaryProps) {
  const [state /*, setState*/] = React.useState<ErrorBoundaryState>({
    hasError: false,
    error: null,
  });

  // const componentDidCatch = (error: Error, errorInfo: ErrorInfo) => {
  //   console.error(error, errorInfo);
  //   setState({hasError: true, error});
  // };

  if (state.hasError) {
    return <ErrorFallback />;
  }

  return children;
}

export default ErrorBoundary;
