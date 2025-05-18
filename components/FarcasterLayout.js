import Head from 'next/head';

const FarcasterLayout = ({ children }) => {
  return (
    <>
      <Head>
        <title>Stack Game</title>
        <meta name="description" content="A 3D stacking game where you try to stack blocks as high as possible" />
        <meta property="og:title" content="Stack Game" />
        <meta property="og:description" content="A 3D stacking game where you try to stack blocks as high as possible" />
        <meta property="og:image" content="https://stack-fc.vercel.app/og-image.png" />
        <meta property="og:url" content="https://stack-fc.vercel.app" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="fc:frame" content={JSON.stringify({
          image: "https://stack-fc.vercel.app/og-image.png",
          buttons: [
            {
              label: "Play Stack Game",
              action: "link",
              target: "https://stack-fc.vercel.app"
            }
          ]
        })} />
      </Head>
      <main className="min-h-screen flex items-center justify-center bg-gray-100">
        {children}
      </main>
    </>
  );
};

export default FarcasterLayout; 