interface LandingPageProps {
  onStart: () => void
}

const workflowSteps = [
  {
    index: '01',
    title: '导入原始图片',
    copy: '拖入 2–12 张 PNG、JPG 或 WebP，图片只在当前浏览器中读取。',
  },
  {
    index: '02',
    title: '选择布局起点',
    copy: '比较经典网格、紧凑自适应和均衡布局，快速确定 Figure 结构。',
  },
  {
    index: '03',
    title: '微调并导出',
    copy: '统一间距、标签和背景，导出高清 PNG、可编辑 SVG 或工程文件。',
  },
]

const faqs = [
  {
    question: '图片会上传到服务器吗？',
    answer: '不会。图片导入、排版、自动保存和导出均在浏览器本地完成，应用没有图片上传接口。',
  },
  {
    question: '支持哪些图片和输出格式？',
    answer: '输入支持 PNG、JPG 和 WebP；输出支持高清 PNG、内嵌原图的可编辑 SVG，以及可恢复编辑的 .figgrid 工程文件。',
  },
  {
    question: '六宫格和九宫格之外还能排什么？',
    answer: '可以处理 2–12 张图片。布局引擎会根据图片比例枚举行分组，并提供三个不重复的候选方案。',
  },
  {
    question: '可以在普通 HTTP 网站上运行吗？',
    answer: '可以。排版、浏览器自动保存和手动导出都支持 HTTP；只有“文件夹自动备份”需要 HTTPS（或 localhost）下的最新版 Chrome / Edge。',
  },
  {
    question: '适合手机使用吗？',
    answer: '首页支持窄屏浏览，但排图工作台面向宽度不低于 1024 px 的桌面屏幕设计。',
  },
]

function Brand() {
  return (
    <span className="landing-brand-lockup">
      <img className="landing-logo" src={`${import.meta.env.BASE_URL}icon.svg`} alt="" />
      <span>
        <strong>论文图片排版助手</strong>
        <small>本地科研多面板排图</small>
      </span>
    </span>
  )
}

function ProductPreview() {
  return (
    <div className="landing-product-preview" aria-label="论文图片排版助手工作台预览">
      <div className="preview-toolbar">
        <div className="preview-brand-mini">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" />
          <b>论文图片排版助手</b>
        </div>
        <div className="preview-project-name">未命名 Figure</div>
        <div className="preview-toolbar-actions">
          <span>● 已本地保存</span>
          <b>导出</b>
        </div>
      </div>
      <div className="preview-workspace">
        <div className="preview-assets">
          <strong>图片面板</strong>
          <div className="preview-drop">＋ 添加图片</div>
          {['A', 'B', 'C', 'D'].map((label, index) => (
            <div className="preview-asset" key={label}>
              <b>{label}</b>
              <span className={`preview-thumb thumb-${index + 1}`} />
              <small>panel-{index + 1}.png</small>
            </div>
          ))}
        </div>
        <div className="preview-canvas-column">
          <div className="preview-candidates">
            {['经典网格', '紧凑自适应', '均衡布局'].map((name, index) => (
              <div className={index === 1 ? 'is-active' : ''} key={name}>
                <span className={`candidate-mini mini-${index + 1}`}>
                  {Array.from({ length: 6 }, (_, cell) => <i key={cell} />)}
                </span>
                <b>{name}</b>
              </div>
            ))}
          </div>
          <div className="preview-figure-wrap">
            <div className="preview-figure">
              {['A', 'B', 'C', 'D', 'E', 'F'].map((label, index) => (
                <span className={`figure-cell figure-cell-${index + 1}`} key={label}>
                  <b>{label}</b>
                  <i />
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="preview-inspector">
          <strong>排版设置</strong>
          <small>画布</small>
          <label>图片间距 <b>20 px</b></label>
          <span className="preview-slider"><i /></span>
          <label>外边距 <b>24 px</b></label>
          <span className="preview-slider second"><i /></span>
          <small>面板标签</small>
          <div className="preview-fields"><span>A, B, C</span><span>左上角</span></div>
          <small>导出</small>
          <div className="preview-resolution"><span>2000</span><b>3000</b><span>4000</span></div>
          <button type="button" tabIndex={-1}>导出高清 PNG</button>
        </div>
      </div>
    </div>
  )
}

export function LandingPage({ onStart }: LandingPageProps) {
  return (
    <div className="landing-page" id="top">
      <header className="landing-header">
        <a className="landing-brand-link" href="#top" aria-label="论文图片排版助手首页">
          <Brand />
        </a>
        <nav aria-label="首页导航">
          <a href="#features">功能</a>
          <a href="#workflow">使用流程</a>
          <a href="#faq">常见问题</a>
        </nav>
        <div className="landing-header-actions">
          <a
            className="landing-github-link"
            href="https://github.com/Resky0/layout-assistant"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          <button type="button" className="landing-header-cta" onClick={onStart}>
            开始排图
          </button>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-badge"><span>✦</span> 免费使用 · 本地处理 · 无需登录</div>
          <h1>让科研排图，<br /><em>简单、准确又体面</em></h1>
          <p>
            从零散原图到投稿级多面板 Figure。自动生成三种布局，保留实验信息，
            在浏览器中完成微调与高清导出。
          </p>
          <div className="landing-hero-actions">
            <button type="button" className="landing-primary-cta" onClick={onStart}>
              立即开始 <span>→</span>
            </button>
            <a className="landing-secondary-cta" href="#features">
              查看如何工作 <span>↓</span>
            </a>
          </div>
          <div className="landing-privacy-line">
            <span><i /> 图片不上传</span>
            <span>支持 2–12 张</span>
            <span>PNG · SVG · FIGGRID</span>
          </div>
          <ProductPreview />
        </section>

        <section className="landing-metrics" aria-label="产品能力概览">
          <div><strong>3</strong><span>种确定性布局</span></div>
          <div><strong>12</strong><span>张图片上限</span></div>
          <div><strong>10K</strong><span>PNG 最大宽度</span></div>
          <div><strong>0</strong><span>张图片上传</span></div>
        </section>

        <section className="landing-section landing-features" id="features">
          <div className="landing-section-heading">
            <span>为什么选择论文图片排版助手？</span>
            <h2>把重复的对齐工作，<br />留给更可靠的规则</h2>
            <p>为科研图片而设计的排版流程，既追求速度，也尊重原始实验信息。</p>
          </div>

          <article className="landing-feature-row">
            <div className="landing-feature-copy">
              <span className="landing-feature-tag">✦ 自动布局</span>
              <h3>三种起点，不再从空白画布猜起</h3>
              <p>根据图片比例枚举行分组，综合留白、行高、面板面积和孤立单图评分，稳定生成三个不重复的候选。</p>
              <ul>
                <li><b>经典网格</b><span>适合六宫格、九宫格等标准结构</span></li>
                <li><b>紧凑自适应</b><span>跟随原图比例，减少无效留白</span></li>
                <li><b>均衡布局</b><span>平衡行高与各面板视觉重量</span></li>
              </ul>
            </div>
            <div className="landing-layout-visual" aria-hidden="true">
              {['经典网格', '紧凑自适应', '均衡布局'].map((name, index) => (
                <div className={index === 1 ? 'is-selected' : ''} key={name}>
                  <span>{name}</span>
                  <i className={`layout-demo layout-demo-${index + 1}`}>
                    {Array.from({ length: 6 }, (_, cell) => <b key={cell} />)}
                  </i>
                  {index === 1 && <em>✓ 推荐</em>}
                </div>
              ))}
            </div>
          </article>

          <article className="landing-feature-row is-reversed">
            <div className="landing-feature-copy">
              <span className="landing-feature-tag is-green">◇ 隐私优先</span>
              <h3>原图留在你的电脑里</h3>
              <p>导入、布局、自动保存和导出均在浏览器本地完成。没有账号系统，也没有把实验图片发送到外部服务器的接口。</p>
              <ul>
                <li><b>本地工程中心</b><span>管理并恢复多个 Figure 工程</span></li>
                <li><b>文件夹自动备份</b><span>停止编辑 2 秒后更新完整 .figgrid</span></li>
                <li><b>完整性校验</b><span>导入工程时验证资源哈希</span></li>
              </ul>
            </div>
            <div className="landing-privacy-visual" aria-hidden="true">
              <div className="privacy-orbit orbit-one" />
              <div className="privacy-orbit orbit-two" />
              <div className="privacy-core">
                <span className="privacy-lock">⌂</span>
                <strong>LOCAL</strong>
                <small>0 张图片上传</small>
              </div>
              <span className="privacy-chip chip-one">IndexedDB</span>
              <span className="privacy-chip chip-two">浏览器本地</span>
              <span className="privacy-chip chip-three">SHA-256</span>
            </div>
          </article>

          <article className="landing-feature-row">
            <div className="landing-feature-copy">
              <span className="landing-feature-tag is-warm">↗ 高清交付</span>
              <h3>从预览到投稿文件，一次完成</h3>
              <p>默认导出 3000 px PNG，也可以按期刊或汇报需求调整宽度；SVG 内嵌原图，标签仍保留为可编辑文本。</p>
              <ul>
                <li><b>高清 PNG</b><span>500–10000 px 自定义宽度</span></li>
                <li><b>可编辑 SVG</b><span>继续在 Illustrator 或 Inkscape 微调</span></li>
                <li><b>透明背景</b><span>方便进入论文、海报和幻灯片</span></li>
              </ul>
            </div>
            <div className="landing-export-visual" aria-hidden="true">
              <div className="export-sheet sheet-back"><span>SVG</span></div>
              <div className="export-sheet sheet-front">
                <span>PNG</span>
                <div>{Array.from({ length: 6 }, (_, cell) => <i key={cell} />)}</div>
                <strong>3000 × 2023 px</strong>
              </div>
              <div className="export-scale"><i /><b>2000</b><b className="is-active">3000</b><b>4000</b></div>
            </div>
          </article>
        </section>

        <section className="landing-workflow" id="workflow">
          <div className="landing-section-heading is-light">
            <span>三分钟完成第一张图</span>
            <h2>从原图到 Figure，只有三步</h2>
          </div>
          <div className="workflow-grid">
            {workflowSteps.map((step) => (
              <article key={step.index}>
                <span>{step.index}</span>
                <div className={`workflow-icon workflow-icon-${step.index}`} aria-hidden="true">
                  <i /><i /><i /><i />
                </div>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-faq landing-section" id="faq">
          <div className="landing-section-heading">
            <span>常见问题</span>
            <h2>开始之前，你可能想知道</h2>
          </div>
          <div className="faq-list">
            {faqs.map((faq, index) => (
              <details key={faq.question} open={index === 0}>
                <summary>{faq.question}<span>＋</span></summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="landing-final-cta">
          <div className="landing-grid-backdrop" aria-hidden="true" />
          <span className="landing-giant-word" aria-hidden="true">FIGURE</span>
          <div>
            <span>论文图片排版助手</span>
            <h2>从下一张 Figure 开始，<br />告别手工对齐</h2>
            <p>无需注册，不上传图片。打开浏览器就能开始。</p>
            <button type="button" className="landing-primary-cta" onClick={onStart}>
              免费开始排图 <span>→</span>
            </button>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <Brand />
        <p>
          为科研图片而做的本地排版工具。
          <a
            className="landing-filing-link"
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noreferrer"
          >
            鲁ICP备2026026679号-2
          </a>
        </p>
        <div>
          <a href="#features">功能</a>
          <a href="#faq">常见问题</a>
          <a href="https://github.com/Resky0/layout-assistant" target="_blank" rel="noreferrer">GitHub</a>
        </div>
      </footer>
    </div>
  )
}
