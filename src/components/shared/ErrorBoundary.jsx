import React from "react";
import { AlertTriangle } from "lucide-react";
import { withTranslation } from "react-i18next";

/**
 * ErrorBoundary — catches React render errors in a subtree and renders a
 * clean fallback UI. Wrap each top-level screen component.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Surface to console for dev visibility. Real telemetry pipes here in production.
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info);
  }

  handleReload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    const { t } = this.props;
    return (
      <div
        role="alert"
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
          background: "var(--bg-base)",
        }}
      >
        <div
          style={{
            maxWidth: 460,
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            padding: "32px 28px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: 12,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              background: "var(--semantic-danger-subtle)",
              border: "1px solid var(--semantic-danger)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--semantic-danger)",
            }}
          >
            <AlertTriangle size={24} strokeWidth={2} aria-hidden="true" />
          </div>
          <div
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 18,
              fontWeight: 600,
              color: "var(--text-primary)",
              lineHeight: 1.3,
            }}
          >
            {t("error_states.boundary_title")}
          </div>
          <div
            style={{
              fontSize: 14,
              color: "var(--text-secondary)",
              lineHeight: 1.6,
            }}
          >
            {t("error_states.boundary_desc")}
          </div>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              background: "var(--accent-primary)",
              color: "var(--accent-primary-text)",
              border: "none",
              padding: "10px 18px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
              marginTop: 4,
            }}
          >
            {t("error_states.reload")}
          </button>
        </div>
      </div>
    );
  }
}

export default withTranslation("common")(ErrorBoundary);
