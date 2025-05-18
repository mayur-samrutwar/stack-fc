import { useRouter } from 'next/router';
import StackGame3D from '../components/StackGame3D';
import FarcasterLayout from '../components/FarcasterLayout';

export default function Home() {
  const router = useRouter();
  const { score } = router.query;

  return (
    <FarcasterLayout>
      <div className="flex flex-col items-center">
        <StackGame3D />
        {score && (
          <div className="mt-4 text-xl text-gray-700">
            Previous Score: {score}
          </div>
        )}
      </div>
    </FarcasterLayout>
  );
} 