export default function NeuralPulse() {
  return (
    <div
      className="neural-pulse"
      role="status"
      aria-label="AI is generating a response"
      aria-live="polite"
    >
      <span className="neural-orb" aria-hidden="true">
        <span className="neural-orb-core" />
        <span className="neural-particle neural-particle-one" />
        <span className="neural-particle neural-particle-two" />
        <span className="neural-particle neural-particle-three" />
      </span>
      <span className="neural-wave" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}
