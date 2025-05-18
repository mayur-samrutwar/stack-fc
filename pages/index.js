import { useRouter } from 'next/router';
import StackGame3D from '../components/StackGame3D';
import FarcasterLayout from '../components/FarcasterLayout';
import styles from '../components/Home.module.css';

export default function Home() {
  const router = useRouter();
  const { score } = router.query;

  return (
    <FarcasterLayout>
      <div className={styles.homeContainer}>
        <StackGame3D />
        {score && (
          <div className={styles.scoreDisplay}>
            Previous Score: {score}
          </div>
        )}
      </div>
    </FarcasterLayout>
  );
} 