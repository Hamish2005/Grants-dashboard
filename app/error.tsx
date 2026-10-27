"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="panel panel-body">
      <h1>Workspace unavailable</h1>
      <p className="help">
        Check that the database is initialized and your internal sign-in gateway
        is configured. Development sign-in is disabled in production.
      </p>
      <button className="button button-outline" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
