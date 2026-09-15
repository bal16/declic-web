export const RED_FIXTURE = 'red-64x48.png';
export const BLUE_FIXTURE = 'blue-48x64.png';

export async function fixtureBytes(name: string): Promise<Uint8Array> {
  const file = Bun.file(`test/fixtures/${name}`);
  return new Uint8Array(await file.arrayBuffer());
}
