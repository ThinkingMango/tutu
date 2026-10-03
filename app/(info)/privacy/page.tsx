import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ContactPanel,
  PolicyCard,
  PolicyHeader,
  PolicyList,
  PolicySection,
  SupportEmailLink,
} from '@/components/info/policy'
import { OPERATOR_NAME, supportMailto } from '@/lib/legal'

export const metadata: Metadata = {
  title: '隐私声明',
  description:
    '小小曼陀罗如何处理信息：孩子无需账号即可涂色，图画保存在设备上，由家长决定是否备份。',
}

const linkClass =
  'font-bold text-primary underline decoration-2 underline-offset-4 hover:decoration-primary/40 outline-none focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50'

export default function PrivacyPage() {
  return (
    <PolicyCard>
      <PolicyHeader
        title="隐私声明"
        intro="小小曼陀罗是一款为幼儿设计的涂色应用。我们在设计时尽量少收集信息：孩子从不需要创建账号，除非家长选择备份，否则他们的图画只保存在设备上。"
      />

      <PolicySection id="who-we-are" title="我们是谁">
        <p>
          {`小小曼陀罗由 ${OPERATOR_NAME} 运营。我们决定此处所述信息的使用方式，并负责妥善保管这些信息。如有任何隐私问题或请求，请发送邮件至 `}
          <SupportEmailLink href={supportMailto('隐私问题')} />。
        </p>
      </PolicySection>

      <PolicySection id="children" title="我们从孩子那里收集什么">
        <p>不收集任何能识别孩子身份的信息。孩子打开应用就可以涂色，不需要为孩子创建账号、登录或个人资料。</p>
        <PolicyList
          items={[
            '我们从不询问孩子的姓名、年龄、生日、照片、声音、学校或位置。',
            '没有广告、没有聊天、没有公开分享，也没有广告追踪器。',
            '购买画册、更改设置和云端保存都需要通过大人验证，并且位于单独的家长区域中。',
          ]}
        />
      </PolicySection>

      <PolicySection id="on-device" title="哪些内容保存在你的设备上">
        <p>
          孩子涂色的图画、“我的花园”中的图画、你选择的设置以及是否通过了大人验证，都保存在你所用设备的浏览器存储中。我们无法看到这些信息。除非你开启云端保存，否则这些信息不会发送给我们。为了在没有网络时也能涂色，设备还会保存一份儿童页面的副本；在你登录期间，还会保存一份你账号所拥有画册的列表。该列表在离线状态下最多可信任
          30 天，并会在你退出登录时删除。清除浏览器中小小曼陀罗的数据会删除以上全部内容。
        </p>
      </PolicySection>

      <PolicySection id="parents" title="我们从家长那里收集什么">
        <p>仅在家长登录、购买画册或开启云端保存时收集：</p>
        <PolicyList
          items={[
            <>
              <strong>你的电子邮箱地址。</strong>你通过我们发送到邮箱的链接登录，因此我们无需存储任何密码。
            </>,
            <>
              <strong>你的购买记录。</strong>
              包括你购买了哪些画册、价格、日期和付款编号，以便你的画册在你登录的每台设备上都能解锁。银行卡信息会直接发送给我们的支付服务商
              Stripe，我们从不查看或存储你的卡号。Stripe 也会根据其自身的隐私政策保存你的电子邮箱和付款记录。
            </>,
            <>
              <strong>云端图画（仅在你开启云端保存时）。</strong>
              对于每张花园图画：使用了哪个图案、每个部分选择的颜色、创作时间以及完成后图画的图片。
              <Link href="/parent/cloud-saving" className={linkClass}>
                云端保存须知
              </Link>
              中有完整说明，你需要先同意才能开启。
            </>,
            <>
              <strong>你的同意记录。</strong>
              当你开启云端保存时，我们会记录日期、你所同意的须知版本，以及你通过近期登录进行了确认。你可以在家长区域的云端保存页面，将该记录连同你所同意的须知一起下载为
              PDF。
            </>,
            <>
              <strong>你发给我们的消息。</strong>如果你通过邮件联系客服，我们会保留对话记录，以便为你提供帮助。
            </>,
          ]}
        />
      </PolicySection>

      <PolicySection id="cookies" title="Cookie 与访问统计">
        <p>
          当家长登录时，我们会设置用于保持登录状态的 Cookie，不作其他用途。我们使用 Vercel Web Analytics
          统计家长区域和这些政策页面的访问量，以了解哪些部分被使用。它从不在孩子使用的页面上运行，不使用
          Cookie，也不会在其他网站上追踪任何人。我们不使用广告或追踪类 Cookie，儿童页面上也没有任何离开应用的链接。
        </p>
      </PolicySection>

      <PolicySection id="why" title="我们为什么使用这些信息">
        <PolicyList
          items={[
            '让你登录并保障账号安全。',
            '收取付款并解锁你购买的画册。',
            '在你开启云端保存后，备份和恢复花园图画。',
            '回答你的问题并处理退款。',
            '保存法律要求的记录，例如用于记账的付款记录。',
          ]}
        />
        <p>我们不会出售你的信息，不会为了广告而共享信息，也不会用它来建立你或你孩子的画像。</p>
      </PolicySection>

      <PolicySection id="providers" title="谁在帮助我们运营应用">
        <p>以下公司代表我们处理信息，仅用于提供其服务，并受其自身安全和隐私条款的约束：</p>
        <PolicyList
          items={[
            <>
              <strong>Supabase</strong>：我们的数据库、登录邮件以及云端图画的私有存储。数据保存在美国。
            </>,
            <>
              <strong>Stripe</strong>：处理银行卡付款和退款。Stripe 也会将你的电子邮箱和付款记录作为其自身记录保存，例如为了遵守金融和反欺诈法律，详见
              <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className={linkClass}>
                Stripe 隐私政策
              </a>
              。删除你的小小曼陀罗账号不会删除这些记录。如需咨询，请直接联系 Stripe。
            </>,
            <>
              <strong>Vercel</strong>：托管应用并提供上文所述的访问统计。
            </>,
          ]}
        />
        <p>如果法律要求，我们也可能共享信息，例如回应合法的法律请求。</p>
      </PolicySection>

      <PolicySection id="how-long" title="我们保留多久">
        <PolicyList
          items={[
            '你的账号和电子邮箱：保留至你删除账号为止。',
            '云端图画：保留至你将其从“我的花园”中移除、关闭云端保存或删除账号为止。',
            '付款记录：删除账号后仍会出于记账需要保留，但不再与你的邮箱或你本人关联。',
            'Stripe 中的电子邮箱和付款记录：由 Stripe 根据其自身隐私政策保存，包括在你删除账号之后。',
            '客服邮件：在帮助你所需的期限内保留，之后删除。',
          ]}
        />
        <p>已删除的数据可能会在服务商的加密备份中短暂保留，直到这些备份过期。</p>
      </PolicySection>

      <PolicySection id="choices" title="你的选择与权利">
        <PolicyList
          items={[
            '无需账号即可使用小小曼陀罗，不登录也能完整涂色。',
            '可随时在家长区域关闭云端保存，这会删除你图画的所有云端副本。',
            '可随时在家长区域删除账号，这会删除你的登录信息、云端图画和账号记录，并锁定你购买的所有画册。你也可以选择从执行删除的设备上移除图画。',
            '可以要求我们提供我们所持有的关于你或你孩子的信息副本，或要求我们更正或删除这些信息。',
          ]}
        />
        <p>
          家长和监护人可随时查看或删除与孩子相关的任何内容。根据你所在地区，你可能还有权反对我们使用你信息的方式，或向当地数据保护机构投诉。我们希望能先有机会为你解决问题，欢迎随时联系我们。
        </p>
      </PolicySection>

      <PolicySection id="changes" title="本声明的变更">
        <p>
          如果我们修改本声明，会更新顶部的日期。如果我们想以新的方式使用云端图画，会事先再次征得你的同意，而不会只是修改声明。
        </p>
      </PolicySection>

      <ContactPanel title="对隐私有疑问？" href={supportMailto('隐私问题')}>
        给我们发邮件，会有真人回复你：
      </ContactPanel>
    </PolicyCard>
  )
}
