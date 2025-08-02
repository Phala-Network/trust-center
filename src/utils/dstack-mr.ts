import {exec} from 'node:child_process'
import * as path from 'node:path'
import {promisify} from 'node:util'
import type {VmConfig} from '../types'

const execAsync = promisify(exec)

const DOCKER_IMAGE = 'shelvenzhou49/dstack-mr-cli:latest'

export interface DstackMrOptions {
  image_folder: string
  vm_config: VmConfig
}

function buildCliArgs(vm_config: VmConfig): string[] {
  const args: string[] = []

  args.push('--cpu', vm_config.cpu_count.toString())
  args.push('--memory', vm_config.memory_size.toString())

  args.push(
    '--two-pass-add-pages',
    vm_config.qemu_single_pass_add_pages.toString(),
  )
  // TODO: this is hardcoded now
  args.push('--pic', 'false')

  if (vm_config.pci_hole64_size > 0) {
    args.push('--pci-hole64-size', vm_config.pci_hole64_size.toString())
  }

  if (vm_config.hugepages) args.push('--hugepages')

  args.push('--num-gpus', vm_config.num_gpus.toString())
  args.push('--num-nvswitches', vm_config.num_nvswitches.toString())
  args.push('--hotplug-off', vm_config.hotplug_off.toString())

  args.push('--json')

  return args
}

export async function measureDstackImages(
  options: DstackMrOptions,
): Promise<any> {
  const cliArgs = buildCliArgs(options.vm_config)
  const argsString = cliArgs.join(' ')

  const command = `docker run --privileged -v "${path.resolve(options.image_folder)}":/app/dstack-images ${DOCKER_IMAGE} measure /app/dstack-images/metadata.json ${argsString}`

  try {
    const {stdout} = await execAsync(command)
    return JSON.parse(stdout)
  } catch (error) {
    const execError = error as {stderr?: string; message: string}
    const errorMessage = execError.stderr || execError.message
    throw new Error(`Failed to run dstack-mr: ${errorMessage}`)
  }
}
