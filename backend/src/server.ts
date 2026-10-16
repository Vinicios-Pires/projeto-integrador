import { app } from './app';
import { env } from './lib/env';

app.listen(env.PORT, () => {
  console.log(`API ouvindo em http://localhost:${env.PORT}`);
});
