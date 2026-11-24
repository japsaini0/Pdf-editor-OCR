import { MARQUEE_SEGMENTS } from '../constants';

export function MarqueeStrip() {
  const renderSegmentGroup = (keyPrefix: string) => (
    <div className="marquee-group" aria-hidden={keyPrefix === 'dup'}>
      {MARQUEE_SEGMENTS.map((segment, index) => (
        <span key={`${keyPrefix}-${index}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 18 }}>
          <span
            className={
              index % 3 === 0
                ? 'marquee-lime'
                : index % 3 === 1
                  ? 'marquee-cyan'
                  : ''
            }
          >
            {segment}
          </span>
          <span className="marquee-star" aria-hidden="true">
            ✳
          </span>
        </span>
      ))}
    </div>
  );

  return (
    <div className="marquee-bar" role="region" aria-label="Lab status ticker">
      <div className="marquee-track">
        {renderSegmentGroup('main')}
        {renderSegmentGroup('dup')}
      </div>
    </div>
  );
}
