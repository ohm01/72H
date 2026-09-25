import { useFocusEffect } from 'expo-router';
import { type SQLiteDatabase, useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

import { onRemoteChange } from './changes';

/** Runs a DB query and re-runs it whenever the screen gains focus or family changes arrive (sync). */
export function useDbQuery<T>(query: (db: SQLiteDatabase) => Promise<T>, deps: unknown[] = []) {
  const db = useSQLiteContext();
  const [data, setData] = useState<T | undefined>(undefined);

  const reload = useCallback(() => {
    let active = true;
    query(db).then((result) => {
      if (active) setData(result);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, ...deps]);

  useFocusEffect(reload);
  useEffect(() => onRemoteChange(() => void reload()), [reload]);

  return { data, reload };
}
