export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.floor(ms)))
}

export function randomNumber({ min = 0, max = 1 }: { min?: number; max?: number }): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function waitingTimeBetweenMessages(): number {
  return randomNumber({
    min: 2000,
    max: 3000,
  })
}
