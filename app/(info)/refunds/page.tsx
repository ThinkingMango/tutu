import type { Metadata } from 'next'
import {
  ContactPanel,
  PolicyCard,
  PolicyHeader,
  PolicyList,
  PolicySection,
  SupportEmailLink,
} from '@/components/info/policy'
import { REFUND_WINDOW_DAYS, supportMailto } from '@/lib/legal'

export const metadata: Metadata = {
  title: '退款政策',
  description: `对漫涂涂的画册改变主意了？购买后 ${REFUND_WINDOW_DAYS} 天内可全额退款，无需说明理由。`,
}

const REFUND_MAILTO = supportMailto('退款申请')

export default function RefundsPage() {
  return (
    <PolicyCard>
      <PolicyHeader
        title="退款政策"
        intro={`改变主意了？在购买后 ${REFUND_WINDOW_DAYS} 天内提出申请，我们会全额退款，无需说明理由。`}
      />

      <PolicySection id="promise" title={`${REFUND_WINDOW_DAYS} 天内全额退款`}>
        <p>
          {`每笔购买都是一次性付款，没有订阅。只要你在购买后 ${REFUND_WINDOW_DAYS} 天内提出申请，无论出于什么原因，即使孩子已经涂过这些图画，我们都会退还整笔订单的款项。`}
        </p>
      </PolicySection>

      <PolicySection id="how" title="如何申请退款">
        <p>
          请使用你登录时所用的电子邮箱发送邮件至 <SupportEmailLink href={REFUND_MAILTO} />
          ，或在邮件中告诉我们该邮箱地址。附上购买日期可以帮助我们更快找到订单。你无需说明理由。
        </p>
      </PolicySection>

      <PolicySection id="what-happens" title="接下来会怎样">
        <PolicyList
          items={[
            '我们会通过 Stripe 将全部款项退回到你付款时使用的银行卡或付款方式。',
            '款项通常会在 5 到 10 个工作日内退回到你的账户。',
            '该订单中的画册会在你的账号中重新锁定。免费图画和你拥有的其他画册不受影响。',
          ]}
        />
      </PolicySection>

      <PolicySection id="bundles" title="组合购买">
        <p>
          退款针对整笔订单。如果你以组合价格一起购买了多本画册，它们会一起退款并一起锁定。如果你只想退回其中几本，请发邮件给我们，我们会和你一起商量解决办法。
        </p>
      </PolicySection>

      <PolicySection id="deleting" title="删除账号">
        <p>
          请在删除账号之前申请退款。删除账号会立即锁定你购买的所有画册，之后无法恢复，即使你用同一邮箱重新注册也不行。如果你已经删除了账号，仍可以用同一邮箱发邮件给我们并附上购买日期，我们会通过
          Stripe 查找这笔付款。
        </p>
      </PolicySection>

      <PolicySection id="after" title={`超过 ${REFUND_WINDOW_DAYS} 天之后`}>
        <p>有些问题无论何时发生都应该得到解决。如遇以下情况，请告诉我们：</p>
        <PolicyList
          items={['已经扣款但画册没有解锁；', '同一本画册被重复扣款；', '画册是误购的，例如被孩子误点购买。']}
        />
        <p>我们会为你解决问题或退款。本政策不影响你根据所在地消费者法律享有的任何权利。</p>
      </PolicySection>

      <ContactPanel title="准备申请退款？" href={REFUND_MAILTO}>
        请用你的登录邮箱发邮件给我们：
      </ContactPanel>
    </PolicyCard>
  )
}
