const React                   = require('react');
const ReactDOM                = require('react-dom');
const joinClasses              = require('classnames');
const keyboardHandlerMixin    = require('../../KeyboardHandlerMixin');
const SimpleTextEditor        = require('./SimpleTextEditor');
const isFunction              = require('../utils/isFunction');


const EditorContainer = React.createClass({
  mixins: [keyboardHandlerMixin],

  propTypes: {
    rowIdx: React.PropTypes.number,
    rowData: React.PropTypes.object.isRequired,
    value: React.PropTypes.oneOfType([React.PropTypes.string, React.PropTypes.number, React.PropTypes.object, React.PropTypes.bool]).isRequired,
    cellMetaData: React.PropTypes.shape({
      selected: React.PropTypes.object.isRequired,
      copied: React.PropTypes.object,
      dragged: React.PropTypes.object,
      onCellClick: React.PropTypes.func,
      onCellDoubleClick: React.PropTypes.func,
      onCommitCancel: React.PropTypes.func,
      onCommit: React.PropTypes.func
    }).isRequired,
    column: React.PropTypes.object.isRequired,
    height: React.PropTypes.number.isRequired
  },

  changeCommitted: false,

  getInitialState() {
    return {isInvalid: false};
  },

  componentDidMount: function() {
    let inputNode = this.getInputNode();
    if (inputNode !== undefined) {
      this.setTextInputFocus();
      if (!this.getEditor().disableContainerStyles) {
        inputNode.className += ' editor-main';
        inputNode.style.height = this.props.height - 1 + 'px';
      }
    }
  },

  componentWillUnmount: function() {
    if (!this.changeCommitted && !this.hasEscapeBeenPressed()) {
      this.commit({key: 'Enter'});
    }
  },

  createEditor(): ReactElement {
    let editorRef = (c) => this.editor = c;
    let editorProps = {
      ref: editorRef,
      column: this.props.column,
      value: this.getInitialValue(),
      onCommit: this.commit,
      rowMetaData: this.getRowMetaData(),
      rowData: this.props.rowData,
      height: this.props.height,
      onBlur: this.commit,
      onOverrideKeyDown: this.onKeyDown
    };

    let CustomEditor = this.props.column.editor;
    // return custom column editor or SimpleEditor if none specified
    if (React.isValidElement(CustomEditor)) {
      return React.cloneElement(CustomEditor, editorProps);
    }
    if (isFunction(CustomEditor)) {
      return <CustomEditor ref={editorRef} {...editorProps} />;
    }

    return <SimpleTextEditor ref={editorRef} column={this.props.column} value={this.getInitialValue()} onBlur={this.commit} rowMetaData={this.getRowMetaData()} onKeyDown={() => {}} commit={() => {}}/>;
  },

  onPressEnter() {
    this.commit({key: 'Enter'});
  },

  onPressTab() {
    this.commit({key: 'Tab'});
  },

  onPressEscape(e: SyntheticKeyboardEvent) {
    if (!this.editorIsSelectOpen()) {
      this.props.cellMetaData.onCommitCancel();
    } else {
      // prevent event from bubbling if editor has results to select
      e.stopPropagation();
    }
  },

  onPressArrowDown(e: SyntheticKeyboardEvent) {
    if (this.editorHasResults()) {
      // dont want to propogate as that then moves us round the grid
      e.stopPropagation();
    } else {
      this.commit(e);
    }
  },

  onPressArrowUp(e: SyntheticKeyboardEvent) {
    if (this.editorHasResults()) {
      // dont want to propogate as that then moves us round the grid
      e.stopPropagation();
    } else {
      this.commit(e);
    }
  },

  onPressArrowLeft(e: SyntheticKeyboardEvent) {
    // prevent event propogation. this disables left cell navigation
    if (!this.isCaretAtBeginningOfInput()) {
      e.stopPropagation();
    } else {
      this.commit(e);
    }
  },

  onPressArrowRight(e: SyntheticKeyboardEvent) {
    // prevent event propogation. this disables right cell navigation
    if (!this.isCaretAtEndOfInput()) {
      e.stopPropagation();
    } else {
      this.commit(e);
    }
  },

  editorHasResults(): boolean {
    if (isFunction(this.getEditor().hasResults)) {
      return this.getEditor().hasResults();
    }

    return false;
  },

  editorIsSelectOpen() {
    if (isFunction(this.getEditor().isSelectOpen)) {
      return this.getEditor().isSelectOpen();
    }

    return false;
  },

  getRowMetaData(): ?any {
    // clone row data so editor cannot actually change this
    // convention based method to get corresponding Id or Name of any Name or Id property
    if (typeof this.props.column.getRowMetaData === 'function') {
      return this.props.column.getRowMetaData(this.props.rowData, this.props.column);
    }
  },

  getEditor(): Editor {
    return this.editor;
  },

  getInputNode(): HTMLInputElement {
    return this.getEditor().getInputNode();
  },

  getInitialValue(): string {
    let selected = this.props.cellMetaData.selected;
    let keyCode = selected.initialKeyCode;
    if (keyCode === 'Delete' || keyCode === 'Backspace') {
      return '';
    } else if (keyCode === 'Enter') {
      return this.props.value;
    }

    let text = keyCode ? String.fromCharCode(keyCode) : this.props.value;
    return text;
  },

  getContainerClass() {
    return joinClasses({
      'has-error': this.state.isInvalid === true
    });
  },

  commit(args: {key : string}) {
    let opts = args || {};
    let updated = this.getEditor().getValue();
    if (this.isNewValueValid(updated)) {
      this.changeCommitted = true;
      let cellKey = this.props.column.key;
      this.props.cellMetaData.onCommit({cellKey: cellKey, rowIdx: this.props.rowIdx, updated: updated, key: opts.key});
    }
  },
  isNewValueValid(value: string): boolean {
    if (isFunction(this.getEditor().validate)) {
      let isValid = this.getEditor().validate(value);
      this.setState({isInvalid: !isValid});
      return isValid;
    }

    return true;
  },

  setCaretAtEndOfInput() {
    let input = this.getInputNode();
    // taken from http://stackoverflow.com/questions/511088/use-javascript-to-place-cursor-at-end-of-text-in-text-input-element
    let txtLength = input.value.length;
    if (input.setSelectionRange) {
      input.setSelectionRange(txtLength, txtLength);
    } else if (input.createTextRange) {
      let fieldRange = input.createTextRange();
      fieldRange.moveStart('character', txtLength);
      fieldRange.collapse();
      fieldRange.select();
    }
  },

  isCaretAtBeginningOfInput(): boolean {
    let inputNode = this.getInputNode();
    return inputNode.selectionStart === inputNode.selectionEnd
      && inputNode.selectionStart === 0;
  },

  isCaretAtEndOfInput(): boolean {
    let inputNode = this.getInputNode();
    return inputNode.selectionStart === inputNode.value.length;
  },

  handleBlur(e) {
    e.stopPropagation();
    // commit if cliked anywhere outside editor
    // prevent commit if any element inside editor is clicked or if the active cell is clicked
    if (e.relatedTarget !== null) {
      if (!e.currentTarget.contains(e.relatedTarget) && !(e.relatedTarget.classList.contains('editing') && e.relatedTarget.classList.contains('react-grid-Cell')))  {
        this.commit(e);
      }
    }else  {
      if (!e.currentTarget.contains(e.relatedTarget)) {
        this.commit(e);
      }
    }
  },

  setTextInputFocus() {
    let selected = this.props.cellMetaData.selected;
    let keyCode = selected.initialKeyCode;
    let inputNode = this.getInputNode();
    inputNode.focus();
    if (inputNode.tagName === 'INPUT') {
      if (!this.isKeyPrintable(keyCode)) {
        inputNode.focus();
        inputNode.select();
      } else {
        inputNode.select();
      }
    }
  },

  hasEscapeBeenPressed() {
    let pressed = false;
    let escapeKey = 27;
    if (window.event) {
      if (window.event.keyCode === escapeKey) {
        pressed = true;
      } else if (window.event.which === escapeKey) {
        pressed  = true;
      }
    }
    return pressed;
  },

  renderStatusIcon(): ?ReactElement {
    if (this.state.isInvalid === true) {
      return <span className="glyphicon glyphicon-remove form-control-feedback"></span>;
    }
  },

  render(): ?ReactElement {
    let divStyle = {
      display: 'inline-block',
      width: '200px',
      height: '200px'
    };
    return (
        <div style={divStyle} className={this.getContainerClass()} onBlur={this.handleBlur} onKeyDown={this.onKeyDown} commit={this.commit}>
          {this.createEditor()}
          {this.renderStatusIcon()}
        </div>
      );
  }
});

module.exports = EditorContainer;
