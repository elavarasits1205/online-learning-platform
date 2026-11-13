import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Avatar, CircularProgress, TextField } from "@mui/material";
import communityApi from "../../service/CommunityApi";
import "./CommunityPage.scss";

const unwrap = (response) => response?.data?.data ?? response?.data ?? [];

const getActiveMention = (target) => {
  if (!target) return null;
  const cursor = target.selectionStart ?? target.value.length;
  const beforeCursor = target.value.slice(0, cursor);
  const match = /(?:^|[\s(])@([a-zA-Z0-9_.-]*)$/.exec(beforeCursor);
  if (!match) return null;

  const atOffset = match[0].lastIndexOf("@");
  return {
    query: match[1],
    start: cursor - match[0].length + atOffset,
    end: cursor,
  };
};

const MentionTextField = forwardRef(function MentionTextField(
  {
    value,
    onChange,
    label,
    placeholder,
    minRows = 2,
    maxRows = 5,
    required = false,
    onKeyDown,
    inputProps = {},
    ...textFieldProps
  },
  forwardedRef
) {
  const textareaRef = useRef(null);
  const [activeMention, setActiveMention] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchedQuery, setSearchedQuery] = useState("");
  const query = activeMention?.query;

  useImperativeHandle(
    forwardedRef,
    () => ({
      focus: () => textareaRef.current?.focus(),
    }),
    []
  );

  useEffect(() => {
    if (!query) {
      setSuggestions([]);
      setLoading(false);
      setSearchedQuery("");
      return undefined;
    }

    setSuggestions([]);
    setLoading(false);
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const result = unwrap(await communityApi.getMentionSuggestions(query));
        if (!cancelled) {
          setSuggestions(
            Array.isArray(result)
              ? result
              : result.suggestions ?? result.users ?? []
          );
          setSearchedQuery(query);
        }
      } catch {
        if (!cancelled) {
          setSuggestions([]);
          setSearchedQuery(query);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const updateMention = (target) => {
    setActiveMention(getActiveMention(target));
  };

  const chooseSuggestion = (member) => {
    if (!activeMention || !textareaRef.current) return;
    const insertion = "@" + member.username + " ";
    const nextValue =
      value.slice(0, activeMention.start) +
      insertion +
      value.slice(activeMention.end);
    const cursor = activeMention.start + insertion.length;

    onChange(nextValue);
    setActiveMention(null);
    setSuggestions([]);

    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(cursor, cursor);
    });
  };

  const showSuggestions =
    Boolean(query) &&
    (loading || suggestions.length > 0 || searchedQuery === query);

  return (
    <div className="community-mention-field">
      <TextField
        {...textFieldProps}
        inputRef={textareaRef}
        fullWidth
        multiline
        minRows={minRows}
        maxRows={maxRows}
        required={required}
        label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          updateMention(event.target);
        }}
        inputProps={{
          ...inputProps,
          onKeyUp: (event) => {
            updateMention(event.currentTarget);
            inputProps.onKeyUp?.(event);
          },
          onClick: (event) => {
            updateMention(event.currentTarget);
            inputProps.onClick?.(event);
          },
          onBlur: (event) => {
            setActiveMention(null);
            inputProps.onBlur?.(event);
          },
          onKeyDown: (event) => {
            onKeyDown?.(event);
            inputProps.onKeyDown?.(event);
          },
        }}
      />
      {showSuggestions && (
        <div className="community-mention-suggestions" role="listbox" aria-label="Mention a community member">
          {loading ? (
            <div className="community-mention-loading">
              <CircularProgress size={18} />
              <span>Finding members…</span>
            </div>
          ) : suggestions.length ? (
            suggestions.map((member) => (
              <button
                type="button"
                role="option"
                aria-selected="false"
                className="community-mention-option"
                key={member.id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chooseSuggestion(member)}
              >
                <Avatar>{String(member.display_name || member.username || "M").charAt(0).toUpperCase()}</Avatar>
                <span className="community-mention-member">
                  <b>{member.display_name || member.username}</b>
                  <small>@{member.username}</small>
                </span>
                <small className="community-mention-role">
                  {(member.roles || []).join(", ").toLowerCase()}
                </small>
              </button>
            ))
          ) : (
            <div className="community-mention-empty">No matching community members.</div>
          )}
        </div>
      )}
    </div>
  );
});

export default MentionTextField;

