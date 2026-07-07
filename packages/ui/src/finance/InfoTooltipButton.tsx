/**
 * InfoTooltipButton — ⓘ pressable that opens a titled explainer Dialog.
 *
 * Shared by finance metric labels (TwrInlineLabel / HoldingReturnInlineLabel) so the
 * tooltip Dialog markup lives in one place.
 */

import type { ReactNode } from "react";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { Button, Dialog, Text } from "../primitives";
import { TYPO_CAPTION, typographyClass } from "../tokens/typography";

export interface InfoTooltipButtonProps {
  readonly title: string;
  readonly body: string;
  readonly closeLabel: string;
  readonly accessibilityLabel?: string;
}

export function InfoTooltipButton({
  title,
  body,
  closeLabel,
  accessibilityLabel,
}: InfoTooltipButtonProps): ReactNode {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        hitSlop={8}
        onPress={() => setOpen(true)}
      >
        <Text className={typographyClass("caption", "text-muted")}>ⓘ</Text>
      </Pressable>

      <Dialog isOpen={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content>
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Description>
              <Text className={TYPO_CAPTION}>{body}</Text>
            </Dialog.Description>
            <View className="mt-4">
              <Button variant="secondary" onPress={() => setOpen(false)}>
                <Button.Label>{closeLabel}</Button.Label>
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </>
  );
}
