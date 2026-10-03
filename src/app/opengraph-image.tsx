import { ImageResponse } from 'next/og';

// Link-preview image for LINE / Facebook / X. Latin text only: the OG
// renderer ships no Thai font, and the Thai tagline lives in the metadata.
export const alt = 'SecondServe — More Than an Expiry Date';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
// Edge runtime + import.meta.url asset loading is the documented next/og
// setup; the Node variant failed to prerender on Windows ("Invalid URL").
export const runtime = 'edge';

export default async function OpengraphImage() {
  const logo = await fetch(new URL('../../public/logoSS.png', import.meta.url)).then((r) =>
    r.arrayBuffer()
  );
  const logoSrc = logo as unknown as string; // next/og accepts an ArrayBuffer as <img src>

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 56,
          padding: '0 96px',
          background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} width={340} height={340} alt="" />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 92, fontWeight: 800, color: '#14532D' }}>
            Second<span style={{ color: '#65A30D' }}>Serve</span>
          </div>
          <div style={{ fontSize: 40, color: '#166534', marginTop: 8 }}>
            More Than an Expiry Date.
          </div>
          <div
            style={{
              marginTop: 36,
              display: 'flex',
              alignSelf: 'flex-start',
              background: '#F97316',
              color: 'white',
              fontSize: 30,
              fontWeight: 700,
              padding: '12px 28px',
              borderRadius: 999,
            }}
          >
            Near-expiry food · Less waste
          </div>
        </div>
      </div>
    ),
    size
  );
}
