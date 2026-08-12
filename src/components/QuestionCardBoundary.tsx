import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  onSkip: () => void
}

interface State {
  failed: boolean
}

/** Keeps one malformed generated item from taking down the whole saved mock. */
export class QuestionCardBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Question failed to render', error, info)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return <div className="question-render-error" role="status"><strong>This question could not be displayed.</strong><p>Your mock progress is saved. Skip this item and continue, or return to it later from the review screen.</p><button type="button" className="primary-button" onClick={this.props.onSkip}>Skip and continue</button></div>
  }
}
