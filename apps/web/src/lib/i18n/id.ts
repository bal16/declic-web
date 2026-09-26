export const id = {
  login: {
    title: 'Masuk ke Akun',
    hint: 'Pilih salah satu metode penyedia layanan di bawah ini.',
    providerDisabled: 'Login dengan {provider} belum dikonfigurasi',
    disabledBanner: 'Login saat ini dinonaktifkan — hanya lihat',
    google: 'Masuk dengan Google',
    github: 'Masuk dengan Github',
  },
  authWall: {
    title: 'Akses Dibatasi',
    message: 'Silakan masuk terlebih dahulu untuk melanjutkan.',
    login: 'Masuk',
  },
  forbidden: {
    title: 'Akses Ditolak',
    message: 'Anda tidak memiliki akses ke halaman ini',
    home: 'Kembali ke Beranda',
  },
} as const;

export type TranslationDict = typeof id;
export function t<
  Section extends keyof TranslationDict,
  Key extends keyof TranslationDict[Section],
>(section: Section, key: Key): string {
  return (id[section] as Record<string, string>)[key as string] as string;
}
