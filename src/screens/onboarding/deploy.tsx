import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { OnboardingContainer, Progress } from '~/components'
import { Cog } from '~/components/svgs'
import { Box, Row, Rows, Stack, Text } from '~/design-system'
import { useNetworkStatus } from '~/hooks'
import { useNetwork } from '~/zustand'

export default function OnboardingDeploy() {
  const navigate = useNavigate()
  const { setOnboarded, upsertNetwork } = useNetwork()

  const [searchParams] = useSearchParams()
  const params = Array.from(searchParams.entries()).reduce(
    (acc, [key, value]) => ({ ...acc, [key]: value }),
    {},
  ) as Record<string, string>

  const { data: instance, isSuccess: isInstanceSuccess } = useQuery<any>({
    queryKey: ['instances', params.name],
    queryFn: async () => {
      return await (
        await fetch('https://forked.network/api/instances', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: params.name,
          }),
        })
      ).json()
    },
    retry: true,
    gcTime: 0,
  })

  const { isSuccess: isIpsSuccess } = useQuery<any>({
    enabled: isInstanceSuccess,
    queryKey: ['ips', instance?.name],
    queryFn: async () => {
      await fetch(
        `https://forked.network/api/instances/${instance?.name}/ips`,
        {
          method: 'POST',
        },
      )
      return null
    },
    retry: true,
    gcTime: 0,
  })

  const { data: machine, isSuccess: isMachineSuccess } = useQuery<any>({
    enabled: isIpsSuccess,
    queryKey: ['machines', instance?.name, params],
    queryFn: async () => {
      return (
        await fetch(
          `https://forked.network/api/instances/${instance?.name}/machines`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(params),
          },
        )
      ).json()
    },
    retry: true,
    gcTime: 0,
  })

  const { isSuccess: isWaitSuccess } = useQuery<any>({
    enabled: isMachineSuccess,
    queryKey: ['wait', instance?.name],
    queryFn: async () => {
      await fetch(`https://forked.network/api/instances/${instance?.name}/wait`)
      return null
    },
    retry: true,
    gcTime: 0,
  })

  const [progress, setProgress] = useState(0)
  useEffect(() => {
    if (isWaitSuccess) return setProgress(75)
    if (isMachineSuccess) return setProgress(55)
    if (isIpsSuccess) return setProgress(40)
    if (isInstanceSuccess) return setProgress(15)
  }, [isWaitSuccess, isMachineSuccess, isIpsSuccess, isInstanceSuccess])
  useEffect(() => {
    let active = true

    function increment() {
      if (!active) return
      setProgress((x) => (x >= 99 ? x : x + 1))
      const timeout = Math.random() * 2000 + 1000
      setTimeout(increment, timeout)
    }
    increment()

    return () => {
      active = false
    }
  }, [])

  const [created, setCreated] = useState(false)
  useEffect(() => {
    if (isWaitSuccess) {
      upsertNetwork({
        network: {
          blockTime: Number(params.blockTime),
          chainId: Number(params.chainId),
          name: params.networkName,
          rpcUrl: machine?.url,
        },
      })
      setCreated(true)
    }
  }, [isWaitSuccess])

  const { data: online } = useNetworkStatus({
    enabled: Boolean(created),
    retryDelay: 2_000,
  })

  useEffect(() => {
    if (online) {
      setOnboarded(true)
      setProgress(100)
      setTimeout(() => navigate('/'), 500)
    }
  }, [online])

  return (
    <OnboardingContainer title='Deploy Node'>
      <Rows>
        <Row alignHorizontal='center' alignVertical='center'>
          <Stack alignHorizontal='center' gap='20px'>
            <Stack alignHorizontal='center' gap='12px'>
              <Cog size='60px' />
              <Text size='20px'>Creating deployment</Text>
            </Stack>
            <Text color='text/tertiary'>Spinning up your Anvil instance.</Text>
            <Stack alignHorizontal='center' gap='12px'>
              <Box style={{ width: 200 }}>
                <Progress height={10} progress={progress} />
              </Box>
              <Text size='12px' color='text/quarternary'>
                {progress}% complete
              </Text>
            </Stack>
          </Stack>
        </Row>
      </Rows>
    </OnboardingContainer>
  )
}